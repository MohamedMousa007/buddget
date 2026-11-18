-- Stay (retention) offers, docs/launch/STORE_SETUP.md: one redemption per account per lifetime, enforced here because
-- Apple does not. The stamp lives on the entitlement (one row per user, keyed by user_id). stay_offer_state gives the
-- eligibility route everything it needs in one call; the rule itself is in src/lib/billing/stayOffer.ts.
alter table public.user_entitlements add column if not exists stay_offer_redeemed_at timestamptz;

create or replace function public.stay_offer_state(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'status', e.status,
    'source', e.source,
    'product_id', e.product_id,
    'redeemed_at', e.stay_offer_redeemed_at,
    -- "lapsed users only after 30 days away": an expiry seen in the last 30 days blocks the offer (billing_events_user_at_idx)
    'lapsed_recently', exists (
      select 1 from public.billing_events b
      where b.user_id = p_user and b.type = 'EXPIRATION' and b.event_at > now() - interval '30 days'))
  from public.user_entitlements e
  where e.user_id = p_user
$$;

revoke all on function public.stay_offer_state(uuid) from public, anon, authenticated;
grant execute on function public.stay_offer_state(uuid) to service_role;
