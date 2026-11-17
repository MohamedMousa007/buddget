-- get_advisors after 0306-0310 (2026-11-17): four unindexed foreign keys, and SECURITY DEFINER functions of the billing, Sparks,
-- loyalty and AI-quota layers executable by anon and authenticated on the live (Frankfurt) database although their migrations
-- revoked that (the grants did not survive the move). With billing switched on this matters: billing_apply, spark_* and trial_claim
-- must only ever run as the service role. Every function below is called from server code with the service client (checked with grep).
-- Client RPCs keep `authenticated` and lose `anon`. Functions outside these layers are listed in the build report for the lead.

create index if not exists spark_spend_allowance_idx on public.spark_spend (allowance_id) where allowance_id is not null;
create index if not exists spark_spend_purchase_idx on public.spark_spend (purchase_id) where purchase_id is not null;
create index if not exists trial_claims_user_idx on public.trial_claims (user_id) where user_id is not null;
create index if not exists paywall_views_user_idx on public.paywall_views (user_id);

do $$
declare f regprocedure;
begin
  -- service role only
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
             'admin_adjust_loyalty_points', 'admin_founder_candidates', 'admin_loyalty_summary', 'admin_entitlement_counts', 'admin_billing_counts',
             'admin_trial_grants_daily', 'ai_effective_limits', 'ai_quota_reserve', 'ai_quota_reserve_v2', 'ai_quota_reserve_v2_core', 'ai_quota_release',
             'ai_quota_settle', 'ai_quota_settle_core', 'ai_quota_status', 'ai_credit_windows', 'ai_usage_state', 'ai_spend_today', 'advisor_gate',
             'usage_reset', 'usage_resets_seen', 'billing_apply', 'billing_note', 'trial_claim', 'handle_new_user',
             'loyalty_award', 'loyalty_close_periods', 'loyalty_decide_credit_name', 'loyalty_decide_founder', 'loyalty_founder_bar',
             'loyalty_grant_founders', 'loyalty_next_founder_number',
             'spark_available', 'spark_charge', 'spark_end_plan_period', 'spark_ensure_allowance', 'spark_open_plan_period', 'spark_open_trial',
             'spark_pack_grant', 'spark_pack_refund', 'spark_restore_plan_period')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- signed-in client RPCs: no anon
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('loyalty_record_week_check', 'loyalty_week_summary', 'loyalty_credits', 'loyalty_request_credit_name',
             'balance_view', 'coming_soon_notify')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
