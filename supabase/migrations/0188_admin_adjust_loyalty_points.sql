-- Atomic loyalty point adjustment: the balance, lifetime, tier and ledger row change in one transaction under a row
-- lock, so concurrent staff adjustments cannot lose an update and a ledger failure rolls the balance back.
-- Returns the new balance and tier, or raises 'insufficient_points' when the balance would go below zero. Service-role only.
CREATE OR REPLACE FUNCTION public.admin_adjust_loyalty_points(p_user uuid, p_delta integer, p_reason text, p_actor uuid)
 RETURNS TABLE(balance integer, tier text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_acc public.loyalty_accounts%rowtype;
  v_balance integer;
  v_lifetime integer;
  v_tier text;
begin
  insert into public.loyalty_accounts(user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_acc from public.loyalty_accounts where user_id = p_user for update;

  v_balance := v_acc.points_balance + p_delta;
  if v_balance < 0 then raise exception 'insufficient_points'; end if;
  v_lifetime := v_acc.lifetime_points + greatest(p_delta, 0);

  if v_acc.tier_locked then
    v_tier := v_acc.tier_key;
  else
    select t.key into v_tier from public.loyalty_tiers t
    where t.status = 'active' and t.min_points <= v_lifetime
    order by t.min_points desc limit 1;
  end if;

  update public.loyalty_accounts
     set points_balance = v_balance, lifetime_points = v_lifetime, tier_key = v_tier, updated_at = now()
   where user_id = p_user;
  insert into public.loyalty_ledger(user_id, delta, reason, actor_id) values (p_user, p_delta, left(p_reason, 200), p_actor);

  return query select v_balance, v_tier;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_loyalty_points(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_loyalty_points(uuid, integer, text, uuid) TO service_role;
