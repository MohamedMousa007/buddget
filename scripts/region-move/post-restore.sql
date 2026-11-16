-- Re-creates what a `supabase db dump` does not carry: objects in Supabase-managed schemas (auth, realtime),
-- reserved-role settings, and pg_cron jobs. Captured from the live project on 2026-11-16. Idempotent.
-- Run on the NEW project after roles.sql, schema.sql and data.sql are restored (run.sh restore does this).

-- 1. Sign-up trigger (function public.handle_new_user is in schema.sql; the trigger lives on auth.users).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 2. Realtime private-channel policies for the SMS nudge broadcast (one channel per user).
drop policy if exists "own nudge channel read" on realtime.messages;
create policy "own nudge channel read" on realtime.messages for select to authenticated
  using ((extension = 'broadcast'::text) and ((select realtime.topic()) = ('user:'::text || ((select auth.uid()))::text)));
drop policy if exists "own nudge channel write" on realtime.messages;
create policy "own nudge channel write" on realtime.messages for insert to authenticated
  with check ((extension = 'broadcast'::text) and ((select realtime.topic()) = ('user:'::text || ((select auth.uid()))::text)));

-- 3. Role settings (reserved roles are stripped from roles.sql). session_preload_libraries is
--    platform-owned (already 'supautils, safeupdate' on new projects; setting it is permission-denied).
alter role authenticator set statement_timeout = '8s';
alter role authenticator set lock_timeout = '8s';
alter role authenticator set pgrst.db_pre_request = 'private.db_pre_request';
alter role authenticated set statement_timeout = '15s';
alter role authenticated set idle_in_transaction_session_timeout = '30s';
alter role anon set statement_timeout = '8s';
alter role anon set idle_in_transaction_session_timeout = '30s';
alter role service_role set statement_timeout = '60s';
alter role portal_reader set statement_timeout = '5s';
alter role portal_reader set lock_timeout = '2s';
alter role portal_actor set statement_timeout = '5s';
alter role portal_actor set lock_timeout = '2s';
notify pgrst, 'reload config';

-- 4. pg_cron jobs (the cron schema is not in the dump). Unschedule first so a re-run doesn't duplicate.
do $$
declare j record;
begin
  for j in select jobname from cron.job loop perform cron.unschedule(j.jobname); end loop;
end $$;
select cron.schedule('analytics-rollup', '20 0 * * *', 'SELECT public.analytics_rollup()');
select cron.schedule('sms-retention', '50 0 * * *', 'SELECT public.sms_retention()');
select cron.schedule('housekeeping', '30 1 * * *', 'SELECT public.housekeeping()');
select cron.schedule('user-milestones', '10 1 * * *', 'SELECT public.refresh_user_milestones()');
select cron.schedule('crash_retention', '40 1 * * *', $c$DELETE FROM public.client_crashes WHERE last_seen < now() - interval '120 days'$c$);
select cron.schedule('cleanup-anon-users', '15 3 * * 0', 'SELECT public.cleanup_abandoned_anon_users()');
select cron.schedule('cleanup-trusted-devices', '20 3 * * *', 'SELECT public.cleanup_expired_trusted_devices()');
select cron.schedule('push-token-sweep', '45 1 * * *', 'SELECT public.push_token_sweep()');
select cron.schedule('cron-log-trim', '40 0 * * *', $c$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$c$);
select cron.schedule('site-leads-retention', '55 1 * * *', $c$DELETE FROM public.site_leads WHERE created_at < now() - interval '180 days'$c$);
select cron.schedule('sms-zero-variance', '17 4 * * *', 'SELECT public.sms_zero_variance_sweep()');
select cron.schedule('sms-tick', '*/15 * * * *', 'SELECT public.sms_tick()');
select cron.schedule('api-rate-cleanup', '0 * * * *', $c$DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '25 hours'$c$);
select cron.schedule('notifications-hourly', '0 * * * *', 'SELECT public.notifications_tick()');
select cron.schedule('db-retention', '10 2 * * *', 'SELECT public.db_retention()');

-- 5. NOT here, on purpose (secrets): re-create the vault secret on the new project in the SQL editor:
--    select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'cron_secret');
--    and set passwords for the LOGIN custom roles (portal_reader, portal_actor) if the admin portal uses them.
