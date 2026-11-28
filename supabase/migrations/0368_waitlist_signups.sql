-- 0368_waitlist_signups.sql
-- PURPOSE
--   Pre-launch waitlist from the public website (/en/waitlist, /ar/waitlist). One row per email with the lead answers
--   (country, platform, how they track money today, what they want most, how they heard), the attribution the page saw
--   (UTM, locale, referrer's share code or an in-app invite code) and the person's own share code.
--   Written only through waitlist_join(), called by the service role from POST /api/site/waitlist (rate-limited,
--   validated, honeypot). RLS on with no policies; nothing granted to anon or authenticated (0316 rule).
--   Read by the admin portal (GET /api/admin/waitlist, permission leads.view). Deleted after 180 days, like site_leads
--   (privacy policy, "Website messages and waitlist sign-ups").
--   The 3 waitlist rows in site_leads move here (they keep their created_at), so the site keeps one waitlist.
--   Queries: waitlist_join hits waitlist_signups_email_key and waitlist_signups_share_code_key (unique) and counts
--   referrals through waitlist_signups_referred_by_idx; the admin list walks waitlist_signups_created_idx by keyset.
-- BEFORE: select count(*) from public.site_leads where kind = 'waitlist';  -- 3 (2026-11-28)
-- ROLLBACK: select cron.unschedule('waitlist-retention'); drop function public.waitlist_join; drop function public.waitlist_share_code;
--           drop table public.waitlist_signups; (re-insert the moved rows into site_leads first if they still matter)

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  name text CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 120),
  country text CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  platform text CHECK (platform IS NULL OR platform IN ('ios', 'android')),
  tracking_now text CHECK (tracking_now IS NULL OR tracking_now IN ('nothing', 'head', 'notes', 'spreadsheet', 'bank_app', 'another_app')),
  want_most text CHECK (want_most IS NULL OR want_most IN ('daily_number', 'bank_texts', 'installments', 'goals', 'income', 'buddgy')),
  heard_from text CHECK (heard_from IS NULL OR heard_from IN ('friend', 'social', 'search', 'store', 'other')),
  share_code text NOT NULL CHECK (share_code ~ '^W[2-9A-HJKMNP-Z]{7}$'),
  referred_by text CHECK (referred_by IS NULL OR referred_by ~ '^W[2-9A-HJKMNP-Z]{7}$'),
  app_invite_code text CHECK (app_invite_code IS NULL OR app_invite_code ~ '^[A-Z0-9]{2,8}-[A-Z0-9]{3,5}$'),
  utm_source text CHECK (utm_source IS NULL OR char_length(utm_source) <= 100),
  utm_medium text CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 100),
  utm_campaign text CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 100),
  utm_content text CHECK (utm_content IS NULL OR char_length(utm_content) <= 100),
  utm_term text CHECK (utm_term IS NULL OR char_length(utm_term) <= 100),
  locale text NOT NULL CHECK (locale IN ('en', 'ar')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_key ON public.waitlist_signups (email);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_share_code_key ON public.waitlist_signups (share_code);
CREATE INDEX IF NOT EXISTS waitlist_signups_referred_by_idx ON public.waitlist_signups (referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS waitlist_signups_created_idx ON public.waitlist_signups (created_at DESC, id DESC);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_signups FROM PUBLIC, anon, authenticated;

-- A fresh share code: 'W' + 7 characters from the invite alphabet (no 0, 1, I, L, O).
CREATE OR REPLACE FUNCTION public.waitlist_share_code() RETURNS text
LANGUAGE sql VOLATILE SET search_path = public, pg_temp AS $$
  SELECT 'W' || string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 7);
$$;
REVOKE ALL ON FUNCTION public.waitlist_share_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_share_code() TO service_role;

-- Joins the list once per email. A repeat email changes nothing and gets the same answer as the first time.
-- referred_by is kept only when it names another person's code that exists.
CREATE OR REPLACE FUNCTION public.waitlist_join(
  p_email text, p_locale text, p_name text DEFAULT NULL, p_country text DEFAULT NULL, p_platform text DEFAULT NULL,
  p_tracking_now text DEFAULT NULL, p_want_most text DEFAULT NULL, p_heard_from text DEFAULT NULL,
  p_referred_by text DEFAULT NULL, p_app_invite_code text DEFAULT NULL,
  p_utm_source text DEFAULT NULL, p_utm_medium text DEFAULT NULL, p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL, p_utm_term text DEFAULT NULL
) RETURNS TABLE (share_code text, referrals integer, is_new boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_ref text := upper(nullif(trim(p_referred_by), ''));
  v_code text;
  v_new boolean := false;
BEGIN
  IF v_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM waitlist_signups w WHERE w.share_code = v_ref AND w.email <> v_email) THEN
    v_ref := NULL;
  END IF;
  FOR i IN 1..5 LOOP
    BEGIN
      INSERT INTO waitlist_signups AS w (email, name, country, platform, tracking_now, want_most, heard_from, share_code,
        referred_by, app_invite_code, utm_source, utm_medium, utm_campaign, utm_content, utm_term, locale)
      VALUES (v_email, p_name, p_country, p_platform, p_tracking_now, p_want_most, p_heard_from, waitlist_share_code(),
        v_ref, upper(nullif(trim(p_app_invite_code), '')), p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_locale)
      ON CONFLICT (email) DO NOTHING
      RETURNING w.share_code INTO v_code;
      v_new := v_code IS NOT NULL;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- share_code collision (the email conflict is absorbed above); draw another code.
      IF i = 5 THEN RAISE; END IF;
    END;
  END LOOP;
  IF v_code IS NULL THEN
    SELECT w.share_code INTO v_code FROM waitlist_signups w WHERE w.email = v_email;
  END IF;
  RETURN QUERY SELECT v_code, (SELECT count(*)::int FROM waitlist_signups w WHERE w.referred_by = v_code), v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.waitlist_join(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_join(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO service_role;

-- Move the existing waitlist rows so there is one list.
INSERT INTO public.waitlist_signups (email, name, share_code, locale, created_at)
SELECT lower(l.email), l.name, public.waitlist_share_code(), l.locale, l.created_at
FROM public.site_leads l WHERE l.kind = 'waitlist'
ON CONFLICT (email) DO NOTHING;
DELETE FROM public.site_leads WHERE kind = 'waitlist';

SELECT cron.schedule(
  'waitlist-retention',
  '57 1 * * *',
  $$DELETE FROM public.waitlist_signups WHERE created_at < now() - interval '180 days'$$
);
