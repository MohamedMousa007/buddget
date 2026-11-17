-- Pro, Rewards, Founders and Invites: the one read behind /api/entitlements/me (`entitlements_state`), the nightly job
-- (`rewards_daily`), and the admin data layer for spec section 5 (`admin_rewards_*`: service role only, each write audit-logged in
-- the same transaction). Shapes: docs/launch/PRO_REWARDS_CONTRACT.md.
--
-- AUDIT SELECT (live, 2026-11-17, before applying): select count(*) from founders;  -- 0. Functions and one constraint only.

alter table public.founders drop constraint if exists founders_retired_reason_check;
alter table public.founders add constraint founders_retired_reason_check check (retired_reason in ('deleted', 'duplicate', 'fraud', 'removed'));

-- ---------------------------------------------------------------- per-user upkeep, run on every /me read
-- Cheap and idempotent: the friend's own activation check (pending row by invitee_id), banked Pro weeks (partial index), the tier.
create or replace function public.rewards_touch(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.referrals where invitee_id = p_user and status = 'pending') then
    perform public.referral_evaluate(p_user, 1);
  end if;
  if exists (select 1 from public.pro_promo_grants where user_id = p_user and started_at is null and revoked_at is null) then
    perform public.promo_apply_banked(p_user);
  end if;
  perform public.loyalty_refresh_tier(p_user);
end;
$$;

-- ---------------------------------------------------------------- the one read for the app
create or replace function public.entitlements_state(p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  a public.loyalty_accounts%rowtype; e public.user_entitlements%rowtype;
  v_tz text; v_wsd smallint; v_today date; v_this date; v_rank smallint; v_founder record; v_pro boolean;
  v_alive boolean; v_gap integer; v_current integer; v_step smallint; v_every integer; v_repair date; v_code text; rc public.referral_codes%rowtype;
  v_month timestamptz; v_prev timestamptz; v_tier jsonb; v_next jsonb; v_weeks jsonb; v_free jsonb; v_pm jsonb; v_hist jsonb; v_first timestamptz;
begin
  perform public.rewards_touch(p_user);
  select * into a from public.loyalty_accounts where user_id = p_user;
  select * into e from public.user_entitlements where user_id = p_user;
  select timezone, week_start_day into v_tz, v_wsd from public.user_settings where user_id = p_user;
  v_tz := coalesce(nullif(v_tz, ''), 'UTC');
  v_today := public.loyalty_local_day(now(), v_tz);
  v_this := public.loyalty_week_start(v_today, v_wsd);
  select number, cohort, credit_name, credit_name_status into v_founder from public.founders where user_id = p_user and retired_at is null;
  v_pro := public.loyalty_pro_active(p_user);

  select jsonb_build_object('key', t.key, 'name', t.name, 'locked', coalesce(a.tier_locked, false)), t.sort_order into v_tier, v_rank
    from public.loyalty_tiers t where t.key = a.tier_key;
  select jsonb_build_object('key', t.key, 'name', t.name, 'minPoints', t.min_points, 'pointsToGo', greatest(0, t.min_points - coalesce(a.lifetime_points, 0)),
                            'requiresPro', t.requires_pro)
    into v_next from public.loyalty_tiers t
    where t.status = 'active' and t.sort_order > coalesce(v_rank, -1)
      and (case when v_founder.number is not null then t.key <> 'elite' else not t.requires_founder end)
    order by t.sort_order limit 1;

  -- Streak: alive while every week since the last kept one (except an open last week) is covered or coverable by banked freezes.
  -- Not alive: the next kept week restarts at 1 and drops one multiplier step per uncovered week, so show that now.
  v_gap := case when a.last_kept_week is null then 0
                else public.loyalty_gap_uncovered(p_user, a.last_kept_week::date + 7, v_this - case when v_today <= v_this + 2 then 14 else 7 end) end;
  v_alive := a.last_kept_week is not null and v_gap <= a.freezes_banked;
  v_current := case when v_alive then a.streak_weeks else 0 end;
  v_step := case when v_alive or a.last_kept_week is null then coalesce(a.multiplier_step, 0) else greatest(0, a.multiplier_step - v_gap) end;
  v_every := case when coalesce(v_rank, 0) >= 1 then 4 else 8 end;
  v_repair := public.loyalty_repairable_week(p_user);
  -- The 12-week strip, oldest first, from the unique (user_id, kind, period_key) index.
  select jsonb_agg(jsonb_build_object('week', g.w::date, 'state',
           case when exists (select 1 from public.loyalty_events x where x.user_id = p_user and x.kind = 'week_kept' and x.period_key = g.w::date::text) then 'kept'
                when exists (select 1 from public.loyalty_events x where x.user_id = p_user and x.kind = 'week_frozen' and x.period_key = g.w::date::text) then 'frozen'
                when g.w::date = v_this or (g.w::date = v_this - 7 and v_today <= v_this + 2) then 'open'
                when exists (select 1 from public.loyalty_seasonal_freezes s where s.starts_on <= g.w::date + 6 and s.ends_on >= g.w::date) then 'frozen'
                when a.last_kept_week is null or g.w::date < (select min(x.period_key) from public.loyalty_events x where x.user_id = p_user and x.kind = 'week_kept')::date then 'before'
                else 'missed' end) order by g.w)
    into v_weeks from generate_series(v_this - 77, v_this, interval '7 days') g(w);

  v_code := public.referral_ensure_code(p_user);
  select * into rc from public.referral_codes where user_id = p_user;

  -- Pro this month: from the (user_id, created_at) cover index, this calendar month and last, in the user's timezone.
  v_month := date_trunc('month', now() at time zone v_tz) at time zone v_tz;
  v_prev := (date_trunc('month', now() at time zone v_tz) - interval '1 month') at time zone v_tz;
  select jsonb_build_object(
      'aiAnswers', jsonb_build_object('thisMonth', count(*) filter (where feature = 'chat' and status = 'ok' and created_at >= v_month),
                                      'lastMonth', count(*) filter (where feature = 'chat' and status = 'ok' and created_at < v_month)),
      'receiptsScanned', jsonb_build_object('thisMonth', count(*) filter (where feature = 'receipt' and status = 'ok' and created_at >= v_month),
                                            'lastMonth', count(*) filter (where feature = 'receipt' and status = 'ok' and created_at < v_month)),
      'creditsUsed', jsonb_build_object('thisMonth', round(coalesce(sum(cost_usd_micro) filter (where feature <> 'sms' and not credits_exempt and created_at >= v_month), 0) / 1000.0, 2),
                                        'lastMonth', round(coalesce(sum(cost_usd_micro) filter (where feature <> 'sms' and not credits_exempt and created_at < v_month), 0) / 1000.0, 2)),
      'monthStart', v_month)
    into v_pm from public.ai_usage_events where user_id = p_user and created_at >= v_prev;
  select jsonb_build_object('aiCreditsWeek', limits -> 'ai_credits_week', 'aiCreditsSession', limits -> 'ai_credits_session',
           'balanceViewsPerMonth', limits -> 'balance_views_per_month', 'budgetPlansMax', limits -> 'budget_plans_max',
           'advisorFreePerMonth', limits -> 'advisor_free_per_month', 'smsAiCallsPerMonth', limits -> 'sms_ai_calls_per_month')
    into v_free from public.plans where key = 'free';

  -- History: store subscription receipts and Sparks packs, newest first, 30 at most (both by (user_id, time) indexes).
  select coalesce(jsonb_agg(h order by h.at desc), '[]'::jsonb) into v_hist from (
    (select b.event_at as at, 'subscription' as kind, b.type, b.store, b.product_id as "productId", b.price_micros as "priceMicros", b.currency,
            null::integer as sparks, null::integer as "bonusSparks", null::timestamptz as "refundedAt"
       from public.billing_events b where b.user_id = p_user and b.type in ('INITIAL_PURCHASE', 'RENEWAL') and b.outcome = 'applied'
       order by b.event_at desc limit 30)
    union all
    (select s.purchased_at, 'sparks', case when s.store = 'admin' then 'ADMIN_GRANT' else 'NON_RENEWING_PURCHASE' end, s.store, s.product_id, s.price_micros, s.currency,
            s.sparks, s.bonus_sparks, s.refunded_at
       from public.spark_purchases s where s.user_id = p_user order by s.purchased_at desc limit 30)
    order by 1 desc limit 30) h;
  select min(event_at) into v_first from public.billing_events where user_id = p_user and type = 'INITIAL_PURCHASE';

  return jsonb_build_object(
    'usage', case when public.billing_enabled() then public.ai_usage_state(p_user) end,
    'subscription', jsonb_build_object('status', e.status, 'source', e.source, 'planKey', e.plan_key, 'willRenew', e.will_renew,
        'currentPeriodEnd', e.current_period_end, 'trialEndsAt', e.trial_ends_at, 'graceEndsAt', e.grace_ends_at, 'productId', e.product_id,
        'canceledAt', e.canceled_at, 'storeCountry', e.store_country, 'memberSince', v_first,
        'bankedProDays', coalesce((select sum(days) from public.pro_promo_grants g where g.user_id = p_user and g.started_at is null and g.revoked_at is null), 0)),
    'history', v_hist,
    'proThisMonth', v_pm || jsonb_build_object('freeCaps', v_free),
    'rewards', jsonb_build_object(
      'tiersEnabled', public.loyalty_tiers_enabled(),
      'tier', v_tier,
      'proActive', v_pro,
      'points', jsonb_build_object('lifetime', coalesce(a.lifetime_points, 0), 'spendable', coalesce(a.points_balance, 0)),
      'nextTier', v_next,
      'tiers', (select jsonb_agg(jsonb_build_object('key', key, 'name', name, 'minPoints', min_points, 'requiresPro', requires_pro,
                  'requiresFounder', requires_founder, 'sparksGift', sparks_gift, 'perks', perks) order by sort_order)
                from public.loyalty_tiers where status = 'active'),
      'streak', jsonb_build_object('current', v_current, 'best', coalesce(a.streak_best, 0),
        'multiplier', case v_step when 2 then 2 when 1 then 1.5 else 1 end,
        'nextMultiplierAt', case when v_step = 0 then 4 when v_step = 1 then 8 else null end,
        'weeks', v_weeks,
        'repair', case when v_repair is null then null else jsonb_build_object('week', v_repair, 'cost', 120, 'until', ((v_this + 5)::timestamp at time zone v_tz)) end),
      'freezes', jsonb_build_object('banked', coalesce(a.freezes_banked, 0), 'max', 2, 'earnEvery', v_every,
        'keptWeeksToNext', v_every - (coalesce(a.kept_weeks_total, 0) % v_every)),
      'founder', case when v_founder.number is null then null else jsonb_build_object('number', v_founder.number, 'cohort', v_founder.cohort,
        'creditName', v_founder.credit_name, 'creditNameStatus', v_founder.credit_name_status) end,
      'betaTester', exists (select 1 from public.beta_testers b where b.user_id = p_user),
      'memberNumber', (select number from public.member_numbers where user_id = p_user),
      'packBonusPercent', public.spark_pack_bonus_percent(p_user, now()),
      'cosmetics', jsonb_build_object('cardFinish', coalesce(a.card_finish, 'standard'), 'buddgyLook', coalesce(a.buddgy_look, 'classic'),
        'owned', coalesce((select jsonb_agg(jsonb_build_object('kind', o.kind, 'key', o.item_key, 'source', o.source)) from public.loyalty_owned_items o where o.user_id = p_user), '[]'::jsonb)),
      'shop', (select jsonb_agg(jsonb_build_object('key', key, 'kind', kind, 'item', item_key, 'cost', cost) order by sort_order) from public.loyalty_shop_items where active),
      'earn', jsonb_build_array(
        jsonb_build_object('key', 'week_kept', 'points', 10, 'multipliers', jsonb_build_array(jsonb_build_object('fromWeek', 4, 'x', 1.5), jsonb_build_object('fromWeek', 8, 'x', 2))),
        jsonb_build_object('key', 'budget_set', 'points', 10),
        jsonb_build_object('key', 'month_tracked', 'points', 40)),
      'invite', jsonb_build_object('enabled', public.referrals_enabled(), 'code', v_code, 'link', 'https://buddget.app/i/' || v_code,
        'invited', rc.invited_count, 'activated', rc.activated_count, 'rewarded', rc.rewards_count))
  );
end;
$$;

-- ---------------------------------------------------------------- the nightly job
-- Set-based steps, each bounded, under a time budget: activation checks (500 pending at most), banked Pro weeks for users whose
-- access ended (500 at most, from the banked partial index), and Pro-gated tiers whose Pro ran out.
create or replace function public.rewards_daily(p_budget_ms integer default 20000)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_start timestamptz := clock_timestamp(); v_act integer := 0; v_started integer := 0; v_tiers integer := 0; u uuid;
begin
  v_act := public.referral_evaluate(null, 500);
  for u in select distinct g.user_id from public.pro_promo_grants g where g.started_at is null and g.revoked_at is null
             and not public.loyalty_pro_active(g.user_id) limit 500 loop
    exit when clock_timestamp() - v_start > make_interval(secs => p_budget_ms / 1000.0);
    if public.promo_apply_banked(u) > 0 then v_started := v_started + 1; end if;
  end loop;
  if clock_timestamp() - v_start <= make_interval(secs => p_budget_ms / 1000.0) then v_tiers := public.loyalty_refresh_pro_tiers(); end if;
  return jsonb_build_object('activated', v_act, 'promosStarted', v_started, 'tiersChanged', v_tiers);
end;
$$;

-- ---------------------------------------------------------------- admin data layer
-- Every write takes p_actor = the staff member's auth user id, checks the staff row is active, and writes admin_audit_log.
create or replace function public.rewards_admin_audit(p_actor uuid, p_action text, p_user uuid, p_summary text, p_meta jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare s record;
begin
  select id, email into s from public.admin_staff where user_id = p_actor and status = 'active';
  if not found then raise exception 'not_staff'; end if;
  insert into public.admin_audit_log (actor_id, actor_email, action, target_type, target_id, summary, metadata)
  values (p_actor, s.email, p_action, 'user', p_user::text, left(p_summary, 500), coalesce(p_meta, '{}'::jsonb));
  return s.id;
end;
$$;

create or replace function public.admin_rewards_pro_grant(p_actor uuid, p_user uuid, p_ends_at timestamptz default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_staff uuid;
begin
  v_staff := public.rewards_admin_audit(p_actor, 'billing.grant_pro', p_user, coalesce(p_note, 'Pro granted'), jsonb_build_object('endsAt', p_ends_at));
  insert into public.user_entitlements (user_id, plan_key, status, source, trial_ends_at, current_period_end, note, granted_by)
  values (p_user, 'plus', 'active', 'promo', null, p_ends_at, coalesce(p_note, 'Granted by staff'), v_staff)
  on conflict (user_id) do update set plan_key = 'plus', status = 'active', source = 'promo', trial_ends_at = null, current_period_end = p_ends_at,
    canceled_at = null, grace_ends_at = null, note = coalesce(p_note, 'Granted by staff'), granted_by = v_staff, updated_at = now();
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.admin_rewards_pro_remove(p_actor uuid, p_user uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_staff uuid;
begin
  v_staff := public.rewards_admin_audit(p_actor, 'billing.remove_pro', p_user, coalesce(p_note, 'Pro removed'));
  update public.user_entitlements set plan_key = 'free', status = 'active', source = 'default', trial_ends_at = null, current_period_end = null,
    canceled_at = null, grace_ends_at = null, note = coalesce(p_note, 'Removed by staff'), granted_by = v_staff, updated_at = now()
  where user_id = p_user;
  return jsonb_build_object('status', case when found then 'ok' else 'no_plan' end);
end;
$$;

create or replace function public.admin_rewards_trial_start(p_actor uuid, p_user uuid, p_days integer default 30)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_staff uuid; v_end timestamptz := now() + make_interval(days => greatest(1, least(coalesce(p_days, 30), 90)));
begin
  v_staff := public.rewards_admin_audit(p_actor, 'billing.start_trial', p_user, 'Trial started', jsonb_build_object('days', p_days));
  insert into public.user_entitlements (user_id, plan_key, status, source, trial_ends_at, note, granted_by)
  values (p_user, 'plus_trial', 'trialing', 'default', v_end, 'Trial by staff', v_staff)
  on conflict (user_id) do update set plan_key = 'plus_trial', status = 'trialing', source = 'default', trial_ends_at = v_end, current_period_end = null,
    canceled_at = null, grace_ends_at = null, note = 'Trial by staff', granted_by = v_staff, updated_at = now();
  return jsonb_build_object('status', 'ok', 'trialEndsAt', v_end);
end;
$$;

create or replace function public.admin_rewards_trial_end(p_actor uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_staff uuid;
begin
  v_staff := public.rewards_admin_audit(p_actor, 'billing.end_trial', p_user, 'Trial ended');
  update public.user_entitlements set plan_key = 'free', status = 'active', source = 'default', trial_ends_at = now(), note = 'Trial ended by staff',
    granted_by = v_staff, updated_at = now()
  where user_id = p_user and status = 'trialing';
  if found then perform public.promo_apply_banked(p_user); end if;
  return jsonb_build_object('status', case when found then 'ok' else 'not_trialing' end);
end;
$$;

-- Banks Pro days that start when current access ends (the invite-reward mechanism, for staff promos).
create or replace function public.admin_rewards_bank_pro_days(p_actor uuid, p_user uuid, p_days integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_staff uuid;
begin
  if p_days is null or p_days <= 0 or p_days > 366 then return jsonb_build_object('status', 'invalid'); end if;
  v_staff := public.rewards_admin_audit(p_actor, 'billing.bank_pro_days', p_user, p_days || ' Pro days banked', jsonb_build_object('days', p_days));
  insert into public.pro_promo_grants (user_id, days, source, granted_by) values (p_user, p_days, 'admin', v_staff);
  return jsonb_build_object('status', 'ok', 'startedDays', public.promo_apply_banked(p_user));
end;
$$;

-- Adds (reward bucket, 12 months; or a purchased-type test grant) or removes Sparks (reward Sparks first, then purchased, soonest expiry first).
create or replace function public.admin_rewards_sparks_adjust(p_actor uuid, p_user uuid, p_amount integer, p_bucket text, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_need integer; r record; v_take integer;
begin
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 or p_bucket not in ('reward', 'purchased') or coalesce(btrim(p_reason), '') = '' then
    return jsonb_build_object('status', 'invalid');
  end if;
  perform public.rewards_admin_audit(p_actor, 'sparks.adjust', p_user, p_reason, jsonb_build_object('amount', p_amount, 'bucket', p_bucket));
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if p_amount > 0 then
    if p_bucket = 'reward' then
      perform public.spark_grant_reward(p_user, p_amount, 'admin:' || gen_random_uuid(), p_reason, false);
    else
      insert into public.spark_purchases (user_id, store, store_txn, product_id, sparks, remaining, purchased_at)
      values (p_user, 'admin', 'admin:' || gen_random_uuid(), 'admin_grant', p_amount, p_amount, now());
    end if;
  else
    v_need := -p_amount;
    for r in select id, granted - used as left_over from public.spark_allowances
             where user_id = p_user and kind = 'reward' and period_start <= now() and period_end > now() and granted > used order by period_end for update loop
      exit when v_need <= 0;
      v_take := least(v_need, r.left_over);
      update public.spark_allowances set granted = granted - v_take where id = r.id;
      v_need := v_need - v_take;
    end loop;
    for r in select id, remaining from public.spark_purchases where user_id = p_user and refunded_at is null and remaining > 0 order by purchased_at for update loop
      exit when v_need <= 0;
      v_take := least(v_need, r.remaining);
      update public.spark_purchases set remaining = remaining - v_take where id = r.id;
      v_need := v_need - v_take;
    end loop;
  end if;
  return jsonb_build_object('status', 'ok', 'available', public.spark_available(p_user, now()));
end;
$$;

-- Read: a user's Sparks ledger (open allowances, the last 50 purchases and spends). Not audited (no write, no personal data beyond counts).
create or replace function public.admin_rewards_sparks_ledger(p_user uuid, p_limit integer default 50)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'available', public.spark_available(p_user, now()),
    'allowances', coalesce((select jsonb_agg(x order by x.period_end desc) from (select id, kind, granted, used, period_start, period_end, ref, reason
        from public.spark_allowances where user_id = p_user order by period_end desc limit least(p_limit, 200)) x), '[]'::jsonb),
    'purchases', coalesce((select jsonb_agg(x order by x.purchased_at desc) from (select id, store, product_id, sparks, bonus_sparks, remaining, price_micros, currency, purchased_at, refunded_at
        from public.spark_purchases where user_id = p_user order by purchased_at desc limit least(p_limit, 200)) x), '[]'::jsonb),
    'spend', coalesce((select jsonb_agg(x order by x.created_at desc) from (select feature, sparks, allowance_id, purchase_id, created_at
        from public.spark_spend where user_id = p_user order by created_at desc limit least(p_limit, 200)) x), '[]'::jsonb))
$$;

-- p_locked true pins p_tier (null = no tier); false unlocks and recomputes.
create or replace function public.admin_rewards_set_tier(p_actor uuid, p_user uuid, p_tier text, p_locked boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if p_tier is not null and not exists (select 1 from public.loyalty_tiers where key = p_tier) then return jsonb_build_object('status', 'unknown_tier'); end if;
  perform public.rewards_admin_audit(p_actor, 'loyalty.set_tier', p_user, 'Tier ' || coalesce(p_tier, 'none') || case when p_locked then ' (locked)' else ' (unlocked)' end,
    jsonb_build_object('tier', p_tier, 'locked', p_locked));
  insert into public.loyalty_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  if p_locked then
    update public.loyalty_accounts set tier_key = p_tier, tier_locked = true, updated_at = now() where user_id = p_user;
  else
    update public.loyalty_accounts set tier_locked = false, updated_at = now() where user_id = p_user;
    perform public.loyalty_refresh_tier(p_user);
  end if;
  return jsonb_build_object('status', 'ok', 'tier', (select tier_key from public.loyalty_accounts where user_id = p_user));
end;
$$;

create or replace function public.admin_rewards_add_freezes(p_actor uuid, p_user uuid, p_count integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v integer;
begin
  perform public.rewards_admin_audit(p_actor, 'loyalty.add_freezes', p_user, p_count || ' freezes', jsonb_build_object('count', p_count));
  insert into public.loyalty_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.loyalty_accounts set freezes_banked = least(2, greatest(0, freezes_banked + coalesce(p_count, 0))), updated_at = now() where user_id = p_user
    returning freezes_banked into v;
  return jsonb_build_object('status', 'ok', 'freezes', v);
end;
$$;

-- Sets the streak (and its multiplier step, defaulting to the step the weeks earn). p_last_kept_week null keeps it alive from last week.
create or replace function public.admin_rewards_set_streak(p_actor uuid, p_user uuid, p_weeks integer, p_step smallint default null, p_last_kept_week date default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_tz text; v_wsd smallint; v_last date;
begin
  if p_weeks is null or p_weeks < 0 or p_weeks > 520 or (p_step is not null and p_step not between 0 and 2) then return jsonb_build_object('status', 'invalid'); end if;
  perform public.rewards_admin_audit(p_actor, 'loyalty.set_streak', p_user, 'Streak ' || p_weeks, jsonb_build_object('weeks', p_weeks, 'step', p_step));
  select timezone, week_start_day into v_tz, v_wsd from public.user_settings where user_id = p_user;
  v_last := coalesce(p_last_kept_week, public.loyalty_week_start(public.loyalty_local_day(now(), v_tz), v_wsd) - 7);
  insert into public.loyalty_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.loyalty_accounts set streak_weeks = p_weeks, streak_best = greatest(streak_best, p_weeks),
    multiplier_step = coalesce(p_step, case when p_weeks >= 8 then 2 when p_weeks >= 4 then 1 else 0 end),
    last_kept_week = case when p_weeks = 0 then null else v_last::text end, updated_at = now()
  where user_id = p_user;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Makes a founder (with a number, or the next one; a retired row of the same user comes back) or changes the number.
create or replace function public.admin_rewards_founder_set(p_actor uuid, p_user uuid, p_number smallint default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_number smallint; v_cap smallint;
begin
  perform pg_advisory_xact_lock(hashtextextended('founders', 0));
  select coalesce(founder_cap, 100) into v_cap from public.loyalty_program;
  v_number := coalesce(p_number, (select coalesce(max(number), 0) + 1 from public.founders));
  if v_number < 1 or v_number > coalesce(v_cap, 100) then return jsonb_build_object('status', 'cap_reached'); end if;
  if exists (select 1 from public.founders where number = v_number and user_id is distinct from p_user) then return jsonb_build_object('status', 'number_taken'); end if;
  perform public.rewards_admin_audit(p_actor, 'loyalty.founder_set', p_user, 'Founder #' || v_number, jsonb_build_object('number', v_number));
  if exists (select 1 from public.founders where user_id = p_user) then
    update public.founders set number = v_number, retired_at = null, retired_reason = null where user_id = p_user;
  else
    insert into public.founders (number, user_id, cohort, qualified_at)
    values (v_number, p_user, case when exists (select 1 from public.beta_testers b where b.user_id = p_user) then 'beta' else 'public' end, now());
    insert into public.loyalty_events (user_id, kind, period_key) values (p_user, 'founder_granted', v_number::text) on conflict do nothing;
  end if;
  return jsonb_build_object('status', 'ok', 'number', v_number);
end;
$$;

-- Retires the founder row (the number is never reissued to someone else).
create or replace function public.admin_rewards_founder_remove(p_actor uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.rewards_admin_audit(p_actor, 'loyalty.founder_remove', p_user, 'Founder removed');
  update public.founders set retired_at = now(), retired_reason = 'removed' where user_id = p_user and retired_at is null;
  return jsonb_build_object('status', case when found then 'ok' else 'not_founder' end);
end;
$$;

-- Clears a user's loyalty: points, streak, freezes, tier lock, owned items, events and ledger (test data). Founder rows stay.
create or replace function public.admin_rewards_loyalty_reset(p_actor uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.rewards_admin_audit(p_actor, 'loyalty.reset', p_user, 'Loyalty reset');
  delete from public.loyalty_events where user_id = p_user and kind <> 'founder_granted';
  delete from public.loyalty_ledger where user_id = p_user;
  delete from public.loyalty_owned_items where user_id = p_user;
  update public.loyalty_accounts set points_balance = 0, lifetime_points = 0, tier_key = null, tier_locked = false, streak_weeks = 0, streak_best = 0,
    freezes_banked = 0, kept_weeks_total = 0, last_kept_week = null, multiplier_step = 0, gifted_rank = 0, card_finish = 'standard', buddgy_look = 'classic', updated_at = now()
  where user_id = p_user;
  perform public.loyalty_refresh_tier(p_user);
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Read: a user's invite code, counters, their invites (50 newest) and the referral that brought them in.
create or replace function public.admin_rewards_referrals_for(p_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'code', (select to_jsonb(c) from public.referral_codes c where c.user_id = p_user),
    'invites', coalesce((select jsonb_agg(x order by x.created_at desc) from (select id, invitee_id, status, reason, active_days, tx_count, reward_kind,
        created_at, activated_at, rewarded_at, ended_at, device_id from public.referrals where inviter_id = p_user order by created_at desc limit 50) x), '[]'::jsonb),
    'invitedBy', (select to_jsonb(r) from public.referrals r where r.invitee_id = p_user),
    'promoGrants', coalesce((select jsonb_agg(g order by g.created_at desc) from (select id, days, source, referral_id, created_at, started_at, revoked_at
        from public.pro_promo_grants where user_id = p_user order by created_at desc limit 50) g), '[]'::jsonb))
$$;

create or replace function public.admin_rewards_referral_approve(p_actor uuid, p_referral bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_inviter uuid;
begin
  select inviter_id into v_inviter from public.referrals where id = p_referral;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  perform public.rewards_admin_audit(p_actor, 'referrals.approve', v_inviter, 'Referral ' || p_referral || ' approved', jsonb_build_object('referral', p_referral));
  return jsonb_build_object('status', public.referral_reward(p_referral, true));
end;
$$;

create or replace function public.admin_rewards_referral_revoke(p_actor uuid, p_referral bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_inviter uuid;
begin
  select inviter_id into v_inviter from public.referrals where id = p_referral;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  perform public.rewards_admin_audit(p_actor, 'referrals.revoke', v_inviter, 'Referral ' || p_referral || ' revoked', jsonb_build_object('referral', p_referral));
  return jsonb_build_object('status', public.referral_clawback(p_referral, 'revoked'));
end;
$$;

-- For testing: marks a pending or expired friend activated, then runs the normal reward path (guards and caps apply).
create or replace function public.admin_rewards_referral_mark_activated(p_actor uuid, p_referral bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_inviter uuid;
begin
  select inviter_id into v_inviter from public.referrals where id = p_referral and status in ('pending', 'expired');
  if not found then return jsonb_build_object('status', 'not_pending'); end if;
  perform public.rewards_admin_audit(p_actor, 'referrals.mark_activated', v_inviter, 'Referral ' || p_referral || ' marked activated', jsonb_build_object('referral', p_referral));
  update public.referrals set status = 'activated', activated_at = now(), ended_at = null where id = p_referral;
  return jsonb_build_object('status', public.referral_reward(p_referral, false));
end;
$$;

-- Platform switches: billing, tiers, referrals, spark_gifts. Tiers off clears every unlocked tier; on recomputes them (set-based,
-- one statement). The caller must invalidate the server settings cache (invalidatePlatformSettings) after this.
create or replace function public.admin_rewards_platform_switch(p_actor uuid, p_key text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_staff uuid; s record;
begin
  if p_key not in ('billing', 'tiers', 'referrals', 'spark_gifts') or p_enabled is null then return jsonb_build_object('status', 'invalid'); end if;
  select id, email into s from public.admin_staff where user_id = p_actor and status = 'active';
  if not found then raise exception 'not_staff'; end if;
  insert into public.admin_audit_log (actor_id, actor_email, action, target_type, target_id, summary, metadata)
  values (p_actor, s.email, 'platform.switch', 'platform_setting', p_key, p_key || case when p_enabled then ' on' else ' off' end, jsonb_build_object('enabled', p_enabled));
  insert into public.platform_settings (key, value, updated_by) values (p_key, jsonb_build_object('enabled', p_enabled), s.id)
  on conflict (key) do update set value = coalesce(public.platform_settings.value, '{}'::jsonb) || jsonb_build_object('enabled', p_enabled), updated_by = s.id, updated_at = now();
  if p_key = 'tiers' then
    update public.loyalty_accounts a set tier_key = case when p_enabled then public.loyalty_tier_key(a.lifetime_points, public.loyalty_pro_active(a.user_id),
        exists (select 1 from public.founders f where f.user_id = a.user_id and f.retired_at is null)) end, updated_at = now()
    where not a.tier_locked;
  end if;
  return jsonb_build_object('status', 'ok', 'key', p_key, 'enabled', p_enabled);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'rewards_touch(uuid)', 'entitlements_state(uuid)', 'rewards_daily(integer)', 'rewards_admin_audit(uuid, text, uuid, text, jsonb)',
    'admin_rewards_pro_grant(uuid, uuid, timestamptz, text)', 'admin_rewards_pro_remove(uuid, uuid, text)', 'admin_rewards_trial_start(uuid, uuid, integer)',
    'admin_rewards_trial_end(uuid, uuid)', 'admin_rewards_bank_pro_days(uuid, uuid, integer)', 'admin_rewards_sparks_adjust(uuid, uuid, integer, text, text)',
    'admin_rewards_sparks_ledger(uuid, integer)', 'admin_rewards_set_tier(uuid, uuid, text, boolean)', 'admin_rewards_add_freezes(uuid, uuid, integer)',
    'admin_rewards_set_streak(uuid, uuid, integer, smallint, date)', 'admin_rewards_founder_set(uuid, uuid, smallint)', 'admin_rewards_founder_remove(uuid, uuid)',
    'admin_rewards_loyalty_reset(uuid, uuid)', 'admin_rewards_referrals_for(uuid)', 'admin_rewards_referral_approve(uuid, bigint)',
    'admin_rewards_referral_revoke(uuid, bigint)', 'admin_rewards_referral_mark_activated(uuid, bigint)', 'admin_rewards_platform_switch(uuid, text, boolean)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
