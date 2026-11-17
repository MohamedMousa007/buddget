-- The region move restored every table, view and sequence with the platform's default grants, undoing the
-- table-level restrictions earlier migrations had set (0201 took everything from anon; later ones narrowed
-- authenticated). RLS still held, so no row was exposed, but the second wall was gone. This rebuilds it:
--   1. anon starts from nothing in public;
--   2. every table/sequence/schema GRANT and REVOKE from migrations 0001-0315 is replayed in its original order;
--   3. TRUNCATE / REFERENCES / TRIGGER go from both client roles, and authenticated loses tables no policy lets it use;
--   4. new tables and sequences get nothing for anon by default.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

do $replay$
declare
  s text;
  stmts text[] := array[
    $acl$grant select on public.sms_parse_today to authenticated$acl$,
    $acl$REVOKE ALL ON public.sms_parse_today FROM PUBLIC, anon, authenticated$acl$,
    $acl$GRANT SELECT ON public.sms_parse_today TO service_role$acl$,
    $acl$GRANT SELECT ON public.sms_parse_today TO authenticated$acl$,
    $acl$REVOKE ALL ON public.app_analytics_daily FROM anon, authenticated$acl$,
    $acl$GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_analytics_daily TO service_role$acl$,
    $acl$REVOKE ALL ON public.app_activity_days FROM PUBLIC, anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.admin_metrics_cache FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.sms_corpus FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.sms_stats_outbox FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.ai_usage_daily FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.admin_access_grants FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.integration_outbox FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.feedback_votes FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.user_milestones FROM anon, authenticated$acl$,
    $acl$GRANT USAGE ON SCHEMA public TO portal_reader, portal_actor$acl$,
    $acl$GRANT SELECT ON public.admin_metrics_cache, public.ai_price_book, public.fx_rates, public.feature_flags TO portal_reader$acl$,
    $acl$REVOKE ALL ON public.user_devices FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.client_crashes FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.admin_financial_exclusions FROM anon, authenticated$acl$,
    $acl$REVOKE ALL ON SCHEMA private FROM PUBLIC$acl$,
    $acl$GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role, authenticator$acl$,
    $acl$REVOKE ALL ON public.trusted_devices FROM anon$acl$,
    $acl$REVOKE SELECT, INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.trusted_devices FROM authenticated$acl$,
    $acl$REVOKE ALL ON public.biometric_devices FROM anon$acl$,
    $acl$REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.biometric_devices FROM authenticated$acl$,
    $acl$REVOKE ALL ON public.sms_ingest_tokens FROM anon$acl$,
    $acl$REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.sms_ingest_tokens FROM authenticated$acl$,
    $acl$REVOKE DELETE ON public.profiles, public.user_settings FROM authenticated$acl$,
    $acl$REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon$acl$,
    $acl$GRANT SELECT ON public.asset_prices, public.merchant_categories TO anon$acl$,
    $acl$REVOKE ALL ON public.merchant_category_overrides FROM PUBLIC, anon, authenticated$acl$,
    $acl$GRANT SELECT, DELETE ON public.merchant_category_overrides TO authenticated$acl$,
    $acl$REVOKE ALL ON public.merchant_category_votes FROM PUBLIC, anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.email_suppressions FROM PUBLIC, anon, authenticated$acl$,
    $acl$GRANT ALL ON public.email_suppressions TO service_role$acl$,
    $acl$REVOKE ALL ON private.anon_cleanup_candidates FROM PUBLIC, anon, authenticated$acl$,
    $acl$revoke all on private.session_second_factor from public, anon, authenticated$acl$,
    $acl$REVOKE ALL ON public.sms_pattern_reviews FROM anon, authenticated$acl$,
    $acl$GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_pattern_reviews TO service_role$acl$,
    $acl$REVOKE ALL ON public.sms_retention_audit FROM anon, authenticated$acl$,
    $acl$GRANT SELECT, INSERT ON public.sms_retention_audit TO service_role$acl$,
    $acl$REVOKE ALL ON public.sms_template_hard_signals FROM anon, authenticated$acl$,
    $acl$GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_template_hard_signals TO service_role$acl$,
    $acl$REVOKE ALL ON public.sms_ai_today FROM PUBLIC, anon, authenticated$acl$,
    $acl$GRANT SELECT ON public.sms_ai_today TO service_role$acl$,
    $acl$REVOKE ALL ON public.client_crash_events FROM anon, authenticated$acl$,
    $acl$REVOKE INSERT, UPDATE, DELETE ON public.site_leads, public.site_stats, public.asset_prices, public.merchant_categories, public.sms_parse_log FROM authenticated$acl$,
    $acl$REVOKE ALL ON public.merchant_categories FROM anon, authenticated$acl$,
    $acl$REVOKE SELECT ON public.biometric_devices FROM authenticated$acl$,
    $acl$REVOKE ALL ON public.site_leads, public.site_stats FROM anon, authenticated$acl$,
    $acl$REVOKE INSERT, UPDATE, DELETE ON public.account_balance_reports, public.ai_chats, public.goal_allocation_runs, public.savings_month_summary FROM authenticated$acl$,
    $acl$REVOKE UPDATE, DELETE ON public.app_analytics_events FROM authenticated$acl$,
    $acl$revoke all on public.sms_own_transfer_answers from anon, authenticated$acl$,
    $acl$revoke all on public.sms_repair_audit from anon, authenticated$acl$,
    $acl$revoke all on sequence public.sms_repair_audit_id_seq from anon, authenticated$acl$,
    $acl$revoke all on public.sms_s3_input from anon, authenticated$acl$,
    $acl$revoke all on public.spark_prices, public.spark_allowances, public.spark_purchases, public.spark_spend from anon, authenticated$acl$,
    $acl$grant select on public.spark_prices, public.spark_allowances, public.spark_purchases, public.spark_spend to authenticated$acl$,
    $acl$grant all on public.spark_prices, public.spark_allowances, public.spark_purchases, public.spark_spend to service_role$acl$,
    $acl$revoke all on public.trial_claims from anon, authenticated$acl$,
    $acl$grant all on public.trial_claims to service_role$acl$,
    $acl$revoke all on public.billing_events from anon, authenticated$acl$,
    $acl$grant all on public.billing_events to service_role$acl$,
    $acl$revoke all on public.loyalty_action_days from anon, authenticated$acl$,
    $acl$grant select on public.loyalty_action_days to service_role$acl$,
    $acl$revoke all on public.loyalty_program from anon, authenticated$acl$,
    $acl$grant all on public.loyalty_program to service_role$acl$,
    $acl$revoke all on public.founders, public.founder_candidates, public.beta_testers, public.loyalty_events, public.loyalty_accounts, public.loyalty_ledger, public.loyalty_tiers from anon, authenticated$acl$,
    $acl$grant select on public.founders, public.beta_testers, public.loyalty_events, public.loyalty_accounts, public.loyalty_ledger to authenticated$acl$,
    $acl$grant all on public.founders, public.founder_candidates, public.beta_testers, public.loyalty_events, public.loyalty_accounts, public.loyalty_ledger, public.loyalty_tiers to service_role$acl$,
    $acl$revoke all on sequence public.loyalty_ledger_id_seq from anon, authenticated$acl$,
    $acl$revoke all on public.paywall_views from anon, authenticated$acl$,
    $acl$grant all on public.paywall_views to service_role$acl$,
    $acl$revoke all on public.gate3_preview_monthly from anon, authenticated$acl$,
    $acl$grant select on public.gate3_preview_monthly to service_role$acl$,
    $acl$revoke all on public.ai_credit_sessions, public.ai_credit_resets, public.advisor_free_uses, public.balance_views, public.spark_products from anon, authenticated$acl$,
    $acl$revoke all on public.coming_soon_interest from anon, authenticated$acl$,
    $acl$grant select on public.coming_soon_interest to authenticated$acl$,
    $acl$grant all on public.ai_credit_sessions, public.ai_credit_resets, public.advisor_free_uses, public.balance_views, public.coming_soon_interest, public.spark_products to service_role$acl$,
    $acl$REVOKE ALL ON public.ai_credit_counters FROM anon, authenticated$acl$,
    $acl$GRANT ALL ON public.ai_credit_counters TO service_role$acl$,
    $acl$revoke all on public.loyalty_seasonal_freezes from anon, authenticated$acl$,
    $acl$grant select on public.loyalty_seasonal_freezes to authenticated$acl$,
    $acl$grant all on public.loyalty_seasonal_freezes to service_role$acl$,
    $acl$revoke all on public.loyalty_shop_items, public.loyalty_owned_items from anon, authenticated$acl$,
    $acl$grant select on public.loyalty_shop_items, public.loyalty_owned_items to authenticated$acl$,
    $acl$grant all on public.loyalty_shop_items, public.loyalty_owned_items to service_role$acl$,
    $acl$revoke all on public.member_numbers from anon, authenticated$acl$,
    $acl$grant select on public.member_numbers to authenticated$acl$,
    $acl$grant all on public.member_numbers to service_role$acl$,
    $acl$revoke all on public.referral_codes, public.referrals, public.pro_promo_grants from anon, authenticated$acl$,
    $acl$grant select on public.referral_codes, public.pro_promo_grants to authenticated$acl$,
    $acl$grant all on public.referral_codes, public.referrals, public.pro_promo_grants to service_role$acl$,
    $acl$revoke all on public.loyalty_action_days from public, anon, authenticated$acl$,
    $acl$revoke all on public.gate3_preview_monthly from public, anon, authenticated$acl$
  ];
begin
  foreach s in array stmts loop
    begin
      execute s;
    exception when undefined_table or undefined_object or invalid_schema_name or undefined_function then
      raise notice 'skipped (object no longer exists): %', s;
    end;
  end loop;
end $replay$;

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke update on all sequences in schema public from authenticated;

-- A table with row security and no policy for the role returns nothing to it; the grant is dead weight that would
-- turn into exposure the day someone adds a loose policy.
do $sweep$
declare r record;
begin
  for r in
    select c.oid::regclass as rel
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
          and (p.roles && array['authenticated', 'public']::name[]))
  loop
    execute format('revoke all on %s from authenticated', r.rel);
  end loop;
end $sweep$;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
