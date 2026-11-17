-- Privileged (SECURITY DEFINER) functions and views were executable with only the public key after the region move.
-- Every one is now limited to the caller that really uses it:
--   trigger functions      -> nobody (a trigger does not need EXECUTE to fire)
--   signed-in user RPCs    -> authenticated (each reads auth.uid() itself)
--   everything else        -> service_role (API routes, crons, other definer functions)
-- New functions no longer get EXECUTE for anon/authenticated by default: grant it in the migration that needs it.

do $$
declare
  r record;
  user_rpcs text[] := array[
    'add_debt_payment_with_expense', 'add_income_with_debt', 'add_subscription_with_recurring_expense',
    'cancel_subscription', 'reactivate_subscription', 'update_subscription_and_re',
    'correct_savings_balance', 'correct_savings_balance_v2', 'deposit_to_savings', 'deposit_to_savings_v2',
    'withdraw_from_savings', 'withdraw_from_savings_v2',
    'analytics_touch', 'second_factor_status', 'sms_run_my_pending_discards'
  ];
  server_only text[] := array[
    'add_sms_debt_payment_with_expense', 'adjust_pocket_balance', 'analytics_rollup', 'api_rate_hit',
    'assert_debt_owned', 'assert_payment_method_owned', 'billing_enabled',
    'bump_sms_template_failure', 'bump_sms_template_failure_v2', 'cast_feedback_vote',
    'check_email_exists', 'check_email_status', 'check_sms_promotion_eligibility',
    'cleanup_abandoned_anon_users', 'cleanup_expired_trusted_devices', 'db_retention',
    'detect_zero_variance_templates', 'find_unclaimed_debt_payment', 'housekeeping',
    'increment_sms_template_match_count', 'integration_outbox_claim',
    'notification_candidate_users', 'notification_due_users', 'notifications_tick',
    'publish_email_template', 'push_token_sweep', 'record_client_crash', 'record_client_crash_v2',
    'record_paywall_view', 'record_second_factor', 'record_sms_template_shadow', 'refresh_user_milestones',
    'revoke_auth_session', 'savings_balance_drift', 'second_factor_verified', 'site_stat_bump',
    'sms_coverage_by_bank', 'sms_discard_after_confirm', 'sms_discard_message', 'sms_heal_stuck',
    'sms_legacy_harvest_pending', 'sms_mark_acked', 'sms_mark_pushed', 'sms_promotion_candidates',
    'sms_retention', 'sms_review_pack', 'sms_run_pending_discards',
    'sms_s3_apply', 'sms_s3_record_insert', 'sms_s3_revert', 'sms_stats_drain',
    'sms_templates_awaiting_adjudication', 'sms_tick', 'sms_zero_variance_sweep',
    'support_submit', 'upsert_merchant_category', 'user_id_by_email'
  ];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname, p.prorettype
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and (p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype) or p.proname = any (user_rpcs) or p.proname = any (server_only))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    if r.prorettype in ('trigger'::regtype, 'event_trigger'::regtype) then
      continue;
    end if;
    execute format('grant execute on function %s to service_role', r.sig);
    if r.proname = any (user_rpcs) then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

-- Owner-rights views that read every user's rows: only definer functions and the server read them.
revoke all on public.loyalty_action_days from public, anon, authenticated;
revoke all on public.gate3_preview_monthly from public, anon, authenticated;

alter function public.loyalty_week_start(date, smallint) set search_path = public, pg_temp;
alter function public.user_settings_sms_first_on() set search_path = public, pg_temp;
alter function private.mask_email(text) set search_path = public, pg_temp;

alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;
