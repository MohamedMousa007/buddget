-- 0203_b3_account_erasure_fks.sql  (QA round 2, B3/S1: C6 / Q5)
--
-- DEPLOY ORDER: RESTRICTIVE (adds foreign keys; deletes orphan rows). Apply AFTER the code in
-- src/lib/server/{deleteAccount,userData}.ts is deployed (the new delete order tolerates both states), and take the
-- backup below first. Installed app builds are unaffected: none of these tables is written by a client.
-- Idempotent: orphan deletes are no-ops on a second run, constraints are created only if missing.
--
-- BACKUP (non-exposed schema, never a public table: default grants would expose it through the anon key):
--   create schema if not exists qa2_backup;  revoke all on schema qa2_backup from public, anon, authenticated;
--   create table if not exists qa2_backup.sms_template_users_0203 as table public.sms_template_users;
--   create table if not exists qa2_backup.sms_tracking_templates_ai_counts_0203 as
--     select id, unique_user_count, tier, status from public.sms_tracking_templates_ai;
--
-- AUDIT BEFORE APPLY (SELECT only), measured 2026-10-28 (sms_template_users: 59 rows, 23 orphans, 36 remain;
-- admin_financial_exclusions.user_id has no FK and is not covered here, noted not changed):
--   -- orphan sms_template_users rows (users deleted without a cascade): expect 23 of 59
--   select count(*) filter (where not exists (select 1 from auth.users u where u.id = s.user_id)), count(*) from public.sms_template_users s;
--   -- orphan email_log / sms_stats_outbox: expect 0 and 0
--   select (select count(*) from public.email_log e where e.user_id is not null and not exists (select 1 from auth.users u where u.id = e.user_id)) as email_log_orphans,
--          (select count(*) from public.sms_stats_outbox o where not exists (select 1 from auth.users u where u.id = o.user_id)) as outbox_orphans;
--   -- templates whose unique_user_count changes: expect 23 (21 go 1 -> 0, 2 go 2 -> 1; all status 'active').
--   -- NO status/tier is changed here; the count only feeds check_sms_promotion_eligibility (min_unique_users), so a lower
--   -- count can only make a future promotion harder, never demote anything. Owner reviews this list:
--   select t.id, t.tier, t.status, t.unique_user_count as stored,
--          (select count(*) from public.sms_template_users u join auth.users a on a.id = u.user_id where u.template_id = t.id) as live
--     from public.sms_tracking_templates_ai t
--    where t.unique_user_count <> (select count(*) from public.sms_template_users u join auth.users a on a.id = u.user_id where u.template_id = t.id);
--   -- the table list the delete/export code is tested against (regenerate src/lib/server/userData.test.ts when this changes):
--   select table_name, column_name from information_schema.columns where table_schema = 'public'
--      and column_name in ('user_id','target_user_id','actor_id','requester_email','to_email') order by 1, 2;

-- F1: email_log.to_email was NOT NULL (0136). The erasure code now writes the placeholder '[erased]' (works either way),
-- and the column is made nullable so a later cleanup may use null. Metadata-only change, no table rewrite.
ALTER TABLE public.email_log ALTER COLUMN to_email DROP NOT NULL;
-- (regenerate database.types.ts after applying: email_log.to_email becomes string | null)

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Orphans (assert the count first, then delete).
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.sms_template_users s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);
  IF n > 30 THEN
    RAISE EXCEPTION '0203: % orphan sms_template_users rows, expected about 23; inspect before deleting', n;
  END IF;
  DELETE FROM public.sms_template_users s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);
  RAISE NOTICE '0203: deleted % orphan sms_template_users rows', n;

  SELECT count(*) INTO n FROM public.sms_stats_outbox o WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.user_id);
  IF n > 50 THEN
    RAISE EXCEPTION '0203: % orphan sms_stats_outbox rows, expected 0; inspect before deleting', n;
  END IF;
  DELETE FROM public.sms_stats_outbox o WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.user_id);

  -- email_log keeps its audit row; only the dangling user reference is cleared.
  UPDATE public.email_log e SET user_id = NULL
   WHERE e.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id);
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Foreign keys (NOT VALID, then VALIDATE: no long lock even on a bigger table).
--    sms_template_users / sms_stats_outbox: personal usage rows leave with the account (CASCADE).
--    email_log: the delivery audit and bounce/complaint suppression history stay, only the link is cleared (SET NULL);
--    the address itself is scrubbed by the delete code (scrubPersonalText) before the user row is removed.
-- ---------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_template_users_user_id_fkey' AND conrelid = 'public.sms_template_users'::regclass) THEN
    ALTER TABLE public.sms_template_users
      ADD CONSTRAINT sms_template_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_log_user_id_fkey' AND conrelid = 'public.email_log'::regclass) THEN
    ALTER TABLE public.email_log
      ADD CONSTRAINT email_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_stats_outbox_user_id_fkey' AND conrelid = 'public.sms_stats_outbox'::regclass) THEN
    ALTER TABLE public.sms_stats_outbox
      ADD CONSTRAINT sms_stats_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
ALTER TABLE public.sms_template_users VALIDATE CONSTRAINT sms_template_users_user_id_fkey;
ALTER TABLE public.email_log VALIDATE CONSTRAINT email_log_user_id_fkey;
ALTER TABLE public.sms_stats_outbox VALIDATE CONSTRAINT sms_stats_outbox_user_id_fkey;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. unique_user_count must follow the rows. Recount once now (orphans inflated it), and keep it right when an
--    account deletion cascades through sms_template_users. Counts only; no tier/status is touched.
-- ---------------------------------------------------------------------------------------------------------------
UPDATE public.sms_tracking_templates_ai t
   SET unique_user_count = c.n
  FROM (SELECT t2.id, (SELECT count(*)::int FROM public.sms_template_users u WHERE u.template_id = t2.id) AS n
          FROM public.sms_tracking_templates_ai t2) c
 WHERE c.id = t.id AND t.unique_user_count IS DISTINCT FROM c.n;

CREATE OR REPLACE FUNCTION public.sms_template_users_recount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update sms_tracking_templates_ai
     set unique_user_count = (select count(*)::int from sms_template_users where template_id = old.template_id)
   where id = old.template_id;
  return old;
end $function$;
REVOKE ALL ON FUNCTION public.sms_template_users_recount() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sms_template_users_recount ON public.sms_template_users;
CREATE TRIGGER trg_sms_template_users_recount
  AFTER DELETE ON public.sms_template_users
  FOR EACH ROW EXECUTE FUNCTION public.sms_template_users_recount();

-- POST-APPLY CHECKS (expect):
--   select count(*) from public.sms_template_users s where not exists (select 1 from auth.users u where u.id = s.user_id); -- 0
--   select conname, convalidated from pg_constraint where conname in ('sms_template_users_user_id_fkey','email_log_user_id_fkey','sms_stats_outbox_user_id_fkey'); -- 3 rows, all true
--   select count(*) from public.sms_template_users; -- 36 (59 - 23)
--   End-to-end: delete a throwaway account with sms_template_users rows -> its rows vanish and unique_user_count drops by one.
