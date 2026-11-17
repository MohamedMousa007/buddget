-- Admin tools for Pro, Sparks, loyalty and invites (spec section 5).
-- 1. The admin role gets the three new permission keys (the owner holds '*').
-- 2. admin_rewards_unbank_pro_days: removes a user's banked (not yet started) Pro days. Audited like the other admin_rewards_* writes.

update public.admin_roles
set permissions = permissions || array(select p from unnest(array['billing.grant', 'sparks.manage', 'referrals.manage']) p where not (p = any (permissions)))
where key = 'admin';

create or replace function public.admin_rewards_unbank_pro_days(p_actor uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_days integer;
begin
  perform public.rewards_admin_audit(p_actor, 'billing.unbank_pro_days', p_user, 'Banked Pro days removed');
  with revoked as (
    update public.pro_promo_grants set revoked_at = now()
    where user_id = p_user and started_at is null and revoked_at is null
    returning days
  )
  select coalesce(sum(days), 0) into v_days from revoked;
  return jsonb_build_object('status', case when v_days > 0 then 'ok' else 'nothing_banked' end, 'removedDays', v_days);
end;
$$;

revoke all on function public.admin_rewards_unbank_pro_days(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_rewards_unbank_pro_days(uuid, uuid) to service_role;
