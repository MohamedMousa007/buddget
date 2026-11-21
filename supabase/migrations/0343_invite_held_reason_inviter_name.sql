-- Invite screen and landing page (BDG-004/005/006), boards S004 and S005.
-- 1. referral_my_summary: each friend gets `held`, why a friend who did their part is not paid yet: 'awaiting_native' (joined on
--    the web, paid once they sign in on a phone) or 'review' (held for a manual check). Null for every other row; the other
--    reasons (device_used, self_device, caps) stay server-side. Same signature, so the grants stay.
-- 2. referral_inviter_first_name(code): the first word of the inviter's display name for the /i/<code> landing page, or null.
--    Callable by anon: one lookup on the unique index referral_codes_code_key, nothing else returned.
-- Pre-checks on live, 2026-11-21: live referral_my_summary matched 0332; 0 held rows; 51 codes.

create or replace function public.referral_my_summary()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); v_code text; rc public.referral_codes%rowtype; v_month integer; v_year integer; v_net text;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  v_code := public.referral_ensure_code(u);
  v_net := private.net_key(private.request_ip());
  if v_net is not null then update public.referral_codes set owner_net = v_net where user_id = u and owner_net is distinct from v_net; end if;
  select * into rc from public.referral_codes where user_id = u;
  select count(*) filter (where rewarded_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'), count(*) into v_month, v_year
    from public.referrals where inviter_id = u and status = 'rewarded' and rewarded_at >= date_trunc('year', now() at time zone 'UTC') at time zone 'UTC';
  return jsonb_build_object(
    'enabled', public.referrals_enabled(),
    'code', v_code,
    'link', 'https://buddget.app/i/' || v_code,
    'counts', jsonb_build_object('invited', rc.invited_count, 'activated', rc.activated_count, 'rewarded', rc.rewards_count),
    'caps', jsonb_build_object('month', 4, 'year', 12, 'monthUsed', v_month, 'yearUsed', v_year),
    'rewards', jsonb_build_object(
      'proDaysEarned', coalesce((select sum(days) from public.pro_promo_grants where user_id = u and source = 'referral' and revoked_at is null), 0),
      'proDaysBanked', coalesce((select sum(days) from public.pro_promo_grants where user_id = u and started_at is null and revoked_at is null), 0),
      'sparksEarned', coalesce((select sum(granted) from public.spark_allowances where user_id = u and kind = 'reward' and ref like 'referral:%'), 0)),
    'milestones', jsonb_build_array(
      jsonb_build_object('friends', 3, 'kind', 'points', 'amount', 50, 'reached', rc.activated_count >= 3),
      jsonb_build_object('friends', 5, 'kind', 'points', 'amount', 100, 'reached', rc.activated_count >= 5),
      jsonb_build_object('friends', 10, 'kind', 'card_finish', 'item', 'connector', 'reached', rc.activated_count >= 10)),
    'friends', coalesce((select jsonb_agg(f order by f.joined_at desc) from (
      select r.id, nullif(split_part(btrim(coalesce(nullif(p.display_name, ''), p.name, '')), ' ', 1), '') as name, r.created_at as joined_at, r.status,
             r.active_days, 3 as active_days_needed, r.tx_count as transactions, 5 as transactions_needed,
             r.invitee_created_at + interval '14 days' as window_ends_at, r.reward_kind,
             case when r.status = 'activated' and r.reason in ('awaiting_native', 'review') then r.reason end as held
      from public.referrals r left join public.profiles p on p.id = r.invitee_id
      where r.inviter_id = u order by r.created_at desc limit 50) f), '[]'::jsonb)
  );
end $$;

create or replace function public.referral_inviter_first_name(p_code text)
returns text language plpgsql stable security definer set search_path to '' as $$
declare v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if v_code !~ '^[A-Z0-9]{2,8}-[A-Z0-9]{3,5}$' or not public.referrals_enabled() then return null; end if;
  return (
    select nullif(left(split_part(regexp_replace(btrim(coalesce(nullif(p.display_name, ''), p.name, '')), '\s+', ' ', 'g'), ' ', 1), 40), '')
    from public.referral_codes c left join public.profiles p on p.id = c.user_id
    where c.code = v_code
  );
end $$;
revoke all on function public.referral_inviter_first_name(text) from public, anon, authenticated, service_role;
grant execute on function public.referral_inviter_first_name(text) to anon, authenticated;

do $$
begin
  assert has_function_privilege('authenticated', 'public.referral_my_summary()', 'execute'), 'summary lost its grant';
  assert not has_function_privilege('anon', 'public.referral_my_summary()', 'execute'), 'summary open to anon';
  assert has_function_privilege('anon', 'public.referral_inviter_first_name(text)', 'execute'), 'first name not callable by anon';
  assert has_function_privilege('authenticated', 'public.referral_inviter_first_name(text)', 'execute'), 'first name not callable by authenticated';
  assert not has_function_privilege('service_role', 'public.referral_inviter_first_name(text)', 'execute'), 'first name grant wider than asked';
end $$;
