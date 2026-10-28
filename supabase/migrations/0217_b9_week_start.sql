-- B9 T8/L18: Settings option "First day of week". Additive and idempotent.
-- Audit (run first, read-only): how many existing users and how many have a reported timezone.
--   SELECT count(*) AS users, count(timezone) AS with_tz FROM public.user_settings;
-- Existing rows get the zone default exactly once (Saturday for Egypt/Gulf zones, and for users whose
-- zone is not reported yet, matching the Cairo fallback used by notifications; Sunday otherwise).
-- New rows stay NULL: the client resolves the default for the device zone, and a later choice overwrites it.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS week_start_day smallint
  CHECK (week_start_day IS NULL OR week_start_day IN (0, 1, 6));

UPDATE public.user_settings
SET week_start_day = CASE
  WHEN timezone IN ('Africa/Cairo','Asia/Riyadh','Asia/Dubai','Asia/Muscat','Asia/Kuwait','Asia/Qatar','Asia/Bahrain','Asia/Aden')
  THEN 6 ELSE 0 END
WHERE week_start_day IS NULL;

-- Post-check: SELECT week_start_day, count(*) FROM public.user_settings GROUP BY 1;
