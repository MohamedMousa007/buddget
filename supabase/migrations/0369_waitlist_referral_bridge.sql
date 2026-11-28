-- 0369_waitlist_referral_bridge.sql
-- PURPOSE
--   Waitlist invites earn the app's real invite rewards (council 2026-11-28, docs/launch/SITE_PRICING_COUNCIL.md, part 2).
--   A waitlist row points at its inviter in one of two ways: referred_by (another waitlist member's share code) or
--   app_invite_code (an in-app code such as LAYLA-7K2, carried from /i/<code>). Once the invitee has a confirmed app
--   account under the SAME email, the daily cron /api/cron/waitlist-referrals records the in-app referral through
--   referral_redeem, so every existing rule applies unchanged: one referral per person and mailbox, no self or same-device
--   invites, network review signals, the inviter rewarded only after the friend activates on a phone (rewards_daily),
--   4 a month and 12 a year, the friend's trial +7 days.
--   The one rule that cannot hold for people who joined before any account existed is "the invitee's account is newer
--   than the inviter's code and under 7 days old" (launch-day sign-ups land in either order). p_waitlist replaces it with
--   "the account is under 14 days old AND a waitlist row proves this exact link", checked inside the function, so the
--   relaxed path cannot be used without a waitlist row. Only service_role can call it.
--   Precedence: an in-app code on the row wins over a waitlist referrer; the first recorded referral wins (unique invitee).
--   waitlist_signups gains referral_status / referral_checked_at so a settled row is never retried.
--   EXPLAIN on live (2026-11-28): waitlist_referral_candidates walks waitlist_signups_referral_open_idx (partial), joins
--   auth.users by email (idx_users_email) and referral_codes by its unique code; bounded by p_limit.
-- ROLLBACK: drop the 7-arg referral_redeem and re-run its 6-arg body from 0333 (with its grants); drop function
--           public.waitlist_referral_candidates(integer); alter table public.waitlist_signups drop column referral_status,
--           drop column referral_checked_at.

ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS referral_status text CHECK (referral_status IS NULL OR char_length(referral_status) <= 40),
  ADD COLUMN IF NOT EXISTS referral_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS waitlist_signups_referral_open_idx ON public.waitlist_signups (created_at)
  WHERE referral_status IS NULL AND (referred_by IS NOT NULL OR app_invite_code IS NOT NULL);

DROP FUNCTION IF EXISTS public.referral_redeem(uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.referral_redeem(p_user uuid, p_code text, p_device_id text DEFAULT NULL::text,
  p_mailbox_key text DEFAULT NULL::text, p_legacy_key text DEFAULT NULL::text, p_ip text DEFAULT NULL::text,
  p_waitlist boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  u uuid := p_user; c record; v_created timestamptz; v_code text := upper(btrim(coalesce(p_code, ''))); v_id bigint; v_extended boolean := false;
  v_dev text := nullif(btrim(coalesce(p_device_id, '')), ''); v_mail text := private.mailbox_key(p_mailbox_key);
  v_legacy text := private.mailbox_key(p_legacy_key); v_net text; v_signals text[] := '{}';
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if not public.referrals_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  if length(v_code) > 40 then return jsonb_build_object('status', 'invalid_code'); end if;
  perform pg_advisory_xact_lock(hashtextextended('referral_redeem:' || u::text, 0));
  select user_id, created_at, owner_net into c from public.referral_codes where code = v_code;
  if not found then return jsonb_build_object('status', 'invalid_code'); end if;
  if c.user_id = u then return jsonb_build_object('status', 'self_invite'); end if;
  select created_at into v_created from auth.users where id = u;
  if v_created is null then raise exception 'not_authenticated'; end if;
  if p_waitlist then
    -- The invitee's own waitlist row (same email as the account) must name this inviter, by app code or by waitlist referrer.
    if not exists (
      select 1 from auth.users au
      join public.waitlist_signups w on w.email = lower(au.email)
      left join public.waitlist_signups inv on inv.share_code = w.referred_by
      left join auth.users iu on iu.email = inv.email
      where au.id = u and (w.app_invite_code = v_code or iu.id = c.user_id)
    ) then
      return jsonb_build_object('status', 'not_waitlisted');
    end if;
    if v_created < now() - interval '14 days' then return jsonb_build_object('status', 'account_too_old'); end if;
  elsif v_created < c.created_at or v_created < now() - interval '7 days' then
    return jsonb_build_object('status', 'account_too_old');
  end if;
  if exists (select 1 from public.referrals r where r.invitee_id = u)
     or (v_mail is not null and exists (select 1 from public.referrals r where r.invitee_mailbox in (v_mail, coalesce(v_legacy, v_mail)))) then
    return jsonb_build_object('status', 'already_redeemed');
  end if;
  if exists (select 1 from public.user_devices a join public.user_devices b on b.device_id = a.device_id where a.user_id = c.user_id and b.user_id = u)
     or (v_dev is not null and exists (select 1 from public.user_devices d where d.user_id = c.user_id and d.device_id = v_dev)) then
    return jsonb_build_object('status', 'self_invite');
  end if;
  if v_dev is not null and exists (select 1 from public.referrals r where r.device_id = v_dev and r.invitee_id is distinct from u) then
    insert into public.referrals (inviter_id, invitee_id, code, device_id, invitee_created_at, status, reason, ended_at, invitee_mailbox)
    values (c.user_id, u, v_code, v_dev, v_created, 'rejected', 'device_used', now(), v_mail);
    return jsonb_build_object('status', 'device_used');
  end if;

  v_net := private.net_key(p_ip);
  if v_net is not null then
    if c.owner_net = v_net then v_signals := v_signals || 'inviter_network'::text; end if;
    if (select count(*) from (select 1 from public.referrals r where r.inviter_id = c.user_id and r.invitee_net = v_net and r.created_at > now() - interval '30 days' limit 2) x) >= 2 then
      v_signals := v_signals || 'repeat_network'::text;
    end if;
  end if;

  insert into public.referrals (inviter_id, invitee_id, code, device_id, invitee_created_at, invitee_mailbox, invitee_net, review_signals)
  values (c.user_id, u, v_code, v_dev, v_created, v_mail, v_net, nullif(v_signals, '{}'))
  returning id into v_id;
  update public.referral_codes set invited_count = invited_count + 1 where user_id = c.user_id;
  update public.user_entitlements set trial_ends_at = trial_ends_at + interval '7 days', updated_at = now()
    where user_id = u and plan_key = 'plus_trial' and status = 'trialing' and trial_ends_at > now();
  v_extended := found;
  if v_extended then update public.referrals set trial_bonus_applied = true where id = v_id; end if;
  return jsonb_build_object('status', 'ok', 'trialExtended', v_extended);
exception when unique_violation then
  return jsonb_build_object('status', 'already_redeemed');
end $function$;
REVOKE ALL ON FUNCTION public.referral_redeem(uuid, text, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_redeem(uuid, text, text, text, text, text, boolean) TO service_role;

-- Waitlist rows whose invitee now has a confirmed account (same email, under 14 days old) and whose inviter has an
-- account. inviter_code is null when that inviter has never opened the invite screen; the cron then calls
-- referral_ensure_code(inviter_id). Rows whose inviter has no account yet are skipped, not settled, and come back later.
CREATE OR REPLACE FUNCTION public.waitlist_referral_candidates(p_limit integer DEFAULT 200)
RETURNS TABLE (waitlist_id uuid, invitee_id uuid, invitee_email text, inviter_id uuid, inviter_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT w.id, au.id, au.email::text, coalesce(app.user_id, iu.id), coalesce(app.code, rc.code)
  FROM public.waitlist_signups w
  JOIN auth.users au ON au.email = w.email AND au.email_confirmed_at IS NOT NULL AND NOT au.is_anonymous
    AND au.created_at > now() - interval '14 days'
  LEFT JOIN public.referral_codes app ON app.code = w.app_invite_code
  LEFT JOIN public.waitlist_signups inv ON inv.share_code = w.referred_by
  LEFT JOIN auth.users iu ON iu.email = inv.email
  LEFT JOIN public.referral_codes rc ON rc.user_id = iu.id
  WHERE w.referral_status IS NULL AND (w.referred_by IS NOT NULL OR w.app_invite_code IS NOT NULL)
    AND (app.code IS NOT NULL OR iu.id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.referrals r WHERE r.invitee_id = au.id)
  ORDER BY w.created_at
  LIMIT least(greatest(p_limit, 1), 500);
$$;
REVOKE ALL ON FUNCTION public.waitlist_referral_candidates(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_referral_candidates(integer) TO service_role;
