-- 0207_b3_cleanup_cron_schedule.sql  (QA round 2, B3/S1: Q7)
--
-- DEPLOY ORDER: ADDITIVE and inert until the owner flips a flag. The anonymous-user cleanup is scheduled WEEKLY but
-- does nothing while platform_settings.anon_cleanup_enabled is not true. The expired-trusted-device cleanup is a plain
-- 180-day expiry and runs from the first night.
--
-- Why the guard (PLAN_REVIEW_A #3): the live cleanup_abandoned_anon_users() deletes every anonymous auth user whose
-- last_sign_in_at (not advanced by token refresh) is older than 14 days, cascading all their finance tables. Live: 8
-- anonymous users, all 8 "idle" by that rule, 1 of them owns an expense and 1 a payment method. The rewritten function
-- keeps the same name/signature (no overload), keeps the 14-day rule, and in addition NEVER selects a user who has any
-- row in the finance/user-content tables, any recent app event, or recently updated profile/settings. Max 50 per run.
--
-- DRY RUN for the owner, any time after this file is applied (works whether or not the flag is on):
--   select id, created_at, last_sign_in_at, idle_days, data_rows, recent_events, recent_settings, protected, would_delete
--     from private.anon_cleanup_candidates order by would_delete desc, created_at;
--   Expected today: 8 rows, would_delete = 6, protected = 2 (the user with 1 expense, the user with 1 payment method).
-- Then, to enable the weekly deletion:
--   insert into public.platform_settings (key, value) values ('anon_cleanup_enabled', 'true'::jsonb)
--     on conflict (key) do update set value = 'true'::jsonb, updated_at = now();
--   (Disabling anonymous sign-ins is a dashboard step for the owner; without it new guests keep appearing.)
--
-- AUDIT BEFORE APPLY (SELECT only), measured 2026-10-28:
--   select count(*) filter (where is_anonymous) as anon_users, count(*) as users from auth.users;                 -- 8 / 45
--   select jobname, schedule from cron.job where jobname in ('cleanup-anon-users','cleanup-trusted-devices');     -- 0 rows before
--   select count(*) from public.trusted_devices where last_used_at < now() - interval '180 days';                  -- 4 of 5 expired
--   select exists (select 1 from pg_extension where extname = 'pg_cron');                                         -- true (1.6.4)
--
-- ROLLBACK: select cron.unschedule('cleanup-anon-users'); select cron.unschedule('cleanup-trusted-devices');

-- 1. Kill switch, default OFF (inserted only if absent so a later owner decision is never overwritten).
INSERT INTO public.platform_settings (key, value) VALUES ('anon_cleanup_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Review list. `private` is not an exposed schema; nothing here is reachable through PostgREST.
CREATE OR REPLACE VIEW private.anon_cleanup_candidates AS
SELECT u.id,
       u.created_at,
       u.last_sign_in_at,
       floor(extract(epoch FROM (now() - coalesce(u.last_sign_in_at, u.created_at))) / 86400)::int AS idle_days,
       d.data_rows,
       e.recent_events,
       s.recent_settings,
       (d.data_rows > 0 OR e.recent_events > 0 OR s.recent_settings > 0) AS protected,
       (coalesce(u.last_sign_in_at, u.created_at) < now() - interval '14 days'
         AND NOT (d.data_rows > 0 OR e.recent_events > 0 OR s.recent_settings > 0)) AS would_delete
  FROM auth.users u
  CROSS JOIN LATERAL (
    SELECT (SELECT count(*) FROM public.expenses x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.income_events x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.income_sources x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.debts x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.debt_payments x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.savings_accounts x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.savings_transactions x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.savings_holdings x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.budget_plans x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.payment_methods x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.goals x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.subscriptions x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.recurring_expenses x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.recurring_debt_payments x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.recurring_savings_deposits x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.receipts x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.account_adjustments x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.buddgy_memories x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.ai_chats x WHERE x.user_id = u.id)
         + (SELECT count(*) FROM public.sms_ingest_tokens x WHERE x.user_id = u.id AND x.is_active) AS data_rows
  ) d
  CROSS JOIN LATERAL (
    SELECT count(*) AS recent_events FROM public.app_analytics_events x
     WHERE x.user_id = u.id AND x.created_at > now() - interval '30 days'
  ) e
  CROSS JOIN LATERAL (
    SELECT (SELECT count(*) FROM public.user_settings x WHERE x.user_id = u.id AND x.updated_at > now() - interval '30 days')
         + (SELECT count(*) FROM public.profiles x WHERE x.id = u.id AND x.updated_at > now() - interval '30 days') AS recent_settings
  ) s
 WHERE u.is_anonymous;
REVOKE ALL ON private.anon_cleanup_candidates FROM PUBLIC, anon, authenticated;

-- 3. The cleanup itself: same name and signature as live (no overload), now guarded by the view and the flag.
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_anon_users()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
declare
  v_deleted int := 0;
  v_id uuid;
begin
  if coalesce((select value from public.platform_settings where key = 'anon_cleanup_enabled'), 'false'::jsonb) <> 'true'::jsonb then
    return 0;
  end if;
  for v_id in
    select id from private.anon_cleanup_candidates where would_delete order by created_at limit 50
  loop
    -- `auth.admin_delete_user` isn't exposed as a SQL function; delete direct. FKs cascade the public.* tables.
    -- F14: one account that cannot be deleted (a NO ACTION FK) must not abort the run or repeat forever.
    begin
      delete from auth.users where id = v_id and is_anonymous;
      v_deleted := v_deleted + 1;
    exception when others then
      raise warning 'cleanup_abandoned_anon_users: skipped % (%)', v_id, sqlerrm;
    end;
  end loop;
  return v_deleted;
end;
$function$;
REVOKE ALL ON FUNCTION public.cleanup_abandoned_anon_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_anon_users() TO service_role;

-- 4. Schedules (cron.schedule upserts by job name, so a re-run does not duplicate). Sunday 03:15 and nightly 03:20 UTC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup-anon-users', '15 3 * * 0', 'SELECT public.cleanup_abandoned_anon_users()');
    PERFORM cron.schedule('cleanup-trusted-devices', '20 3 * * *', 'SELECT public.cleanup_expired_trusted_devices()');
  END IF;
END $$;

-- POST-APPLY CHECKS (expect):
--   select jobname, schedule, active from cron.job where jobname in ('cleanup-anon-users','cleanup-trusted-devices'); -- 2 rows
--   select public.cleanup_abandoned_anon_users();   -- 0 while the flag is false (nothing deleted)
--   select count(*) from auth.users where is_anonymous; -- still 8
--   select count(*) from pg_proc where proname = 'cleanup_abandoned_anon_users'; -- 1
