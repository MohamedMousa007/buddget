-- referral_reward (0308) counted a friend as activated, and paid milestones, before the device guards ran: a friend rejected for
-- sharing the inviter's device (or a rewarded friend's) still counted toward the 3 / 5 / 10 milestones. The guards now run first.
-- Function body only; no data changed (select count(*) from referrals = 0 live).

create or replace function public.referral_reward(p_id bigint, p_force boolean default false)
returns text language plpgsql security definer set search_path to 'public' as $$
declare r public.referrals%rowtype; v_month integer; v_year integer; v_act integer; e record; v_store boolean;
begin
  select * into r from public.referrals where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.inviter_id is null or r.invitee_id is null then return r.status; end if;
  if not (r.status = 'activated' or (p_force and r.status in ('capped', 'rejected', 'pending', 'expired'))) then return r.status; end if;
  perform pg_advisory_xact_lock(hashtextextended('referral:' || r.inviter_id::text, 0));

  if not p_force then
    if exists (select 1 from public.user_devices a join public.user_devices b on b.device_id = a.device_id where a.user_id = r.inviter_id and b.user_id = r.invitee_id) then
      update public.referrals set status = 'rejected', reason = 'self_device', ended_at = now() where id = p_id;
      return 'rejected';
    end if;
    if exists (select 1 from public.user_devices d join public.referrals o on o.device_id = d.device_id
               where d.user_id = r.invitee_id and o.id <> r.id and o.status = 'rewarded') then
      update public.referrals set status = 'rejected', reason = 'device_used', ended_at = now() where id = p_id;
      return 'rejected';
    end if;
  end if;

  -- First time this friend counts as activated: the counter and the milestones (capped friends count too).
  if r.status = 'activated' or (p_force and r.status in ('pending', 'expired')) then
    update public.referral_codes set activated_count = activated_count + 1 where user_id = r.inviter_id returning activated_count into v_act;
    if r.activated_at is null then update public.referrals set activated_at = now() where id = p_id; end if;
    if v_act = 3 then perform public.loyalty_award(r.inviter_id, 50, 'referral_milestone', '3'); end if;
    if v_act = 5 then perform public.loyalty_award(r.inviter_id, 100, 'referral_milestone', '5'); end if;
    if v_act = 10 then insert into public.loyalty_owned_items (user_id, kind, item_key, source) values (r.inviter_id, 'card_finish', 'connector', 'milestone') on conflict do nothing; end if;
  end if;

  if not p_force then
    select count(*) filter (where rewarded_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'), count(*)
      into v_month, v_year
      from public.referrals where inviter_id = r.inviter_id and status = 'rewarded' and rewarded_at >= date_trunc('year', now() at time zone 'UTC') at time zone 'UTC';
    if v_month >= 4 or v_year >= 12 then
      update public.referrals set status = 'capped', reason = case when v_year >= 12 then 'year_cap' else 'month_cap' end where id = p_id;
      return 'capped';
    end if;
  end if;

  select plan_key, status, source, trial_ends_at, current_period_end, grace_ends_at into e from public.user_entitlements where user_id = r.inviter_id;
  v_store := found and e.plan_key = 'plus' and e.source in ('apple', 'google') and e.status <> 'trialing'
             and public.entitlement_grants(e.status, e.trial_ends_at, e.current_period_end, e.grace_ends_at, now());
  if v_store then
    perform public.spark_grant_reward(r.inviter_id, 500, 'referral:' || p_id, 'Invite reward', false);
  else
    insert into public.pro_promo_grants (user_id, days, source, referral_id) values (r.inviter_id, 7, 'referral', p_id);
    perform public.promo_apply_banked(r.inviter_id);
  end if;
  update public.referrals set status = 'rewarded', reason = null, rewarded_at = now(), reward_kind = case when v_store then 'sparks' else 'pro_week' end where id = p_id;
  update public.referral_codes set rewards_count = rewards_count + 1 where user_id = r.inviter_id;
  return 'rewarded';
end;
$$;
