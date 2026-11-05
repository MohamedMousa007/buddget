-- 0238_site_leads_retention.sql  (QA round 5, SIT9)
--
-- Website contact messages and waitlist sign-ups (public.site_leads) had no reader, no deletion path and no policy line.
-- 1. Retention: a nightly pg_cron job deletes leads older than 180 days (the privacy policy now says so, EN + AR).
-- 2. Reader: the admin portal gets a read-only "Website leads" list behind the new `leads.view` permission.
--
-- BEFORE (SELECT): select count(*), count(*) filter (where created_at < now() - interval '180 days') from public.site_leads;  -- 1 / 0
-- ROLLBACK: select cron.unschedule('site-leads-retention');
--           update public.admin_roles set permissions = array_remove(permissions, 'leads.view');

SELECT cron.schedule(
  'site-leads-retention',
  '55 1 * * *',
  $$DELETE FROM public.site_leads WHERE created_at < now() - interval '180 days'$$
);

UPDATE public.admin_roles
SET permissions = permissions || ARRAY['leads.view']
WHERE key IN ('admin', 'support_lead', 'growth') AND NOT ('leads.view' = ANY (permissions));
